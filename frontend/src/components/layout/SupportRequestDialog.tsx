import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Paperclip, X } from 'lucide-react'
import { Button } from '../ui/button'
import { ModalBackdrop } from '../ui/modal-backdrop'
import { api } from '../../api/client'
import { queryKeys } from '../../api/queryKeys'
import { formatCentralSupportStatus } from '../../utils/centralSupportStatus'
import { ATTACHMENT_FILE_ACCEPT, isAllowedAttachmentFileName } from '../../utils/attachmentAccept'
import { exceedsAttachmentTotalLimit, sumFileSizes } from '../../utils/attachmentLimits'
import { pickAttachmentFiles, supportsAttachmentFilePicker } from '../../utils/attachmentFilePicker'
import { lowercaseFileExtension } from '../../utils/fileNameDisplay'
import { toSentenceCaseTr } from '../../utils/textNormalization'

interface SupportRequestDialogProps {
  open: boolean
  onClose: () => void
  /** createOnly: yalnızca yeni talep formu (sayfa grid + dosya ekle). */
  variant?: 'default' | 'createOnly'
}

export function SupportRequestDialog({ open, onClose, variant = 'default' }: SupportRequestDialogProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [centralSyncFailed, setCentralSyncFailed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showHistory = variant === 'default'
  const myRequestsQuery = useQuery({
    queryKey: queryKeys.supportRequests.mine(),
    queryFn: () => api.getMySupportRequests(),
    enabled: open && showHistory,
    refetchInterval: open && showHistory ? 30000 : false,
  })

  if (!open) return null

  const trimmedSubject = subject.trim()
  const trimmedMessage = message.trim()
  const canSubmit = trimmedSubject.length >= 4 && trimmedMessage.length >= 10 && !sending

  const resetForm = () => {
    setSubject('')
    setMessage('')
    setPendingFiles([])
    setFileError(null)
    setError(null)
    setSent(false)
    setCentralSyncFailed(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const addPickedFiles = (incoming: File[]) => {
    if (incoming.length === 0) return
    const invalid = incoming.find(file => !isAllowedAttachmentFileName(file.name))
    if (invalid) {
      setFileError(t('attachments.errorType', 'Yalnızca izin verilen dosya türleri yüklenebilir.'))
      return
    }
    setPendingFiles(prev => {
      const incomingBytes = sumFileSizes(incoming)
      if (exceedsAttachmentTotalLimit(sumFileSizes(prev), incomingBytes)) {
        setFileError(t('attachments.errorTotalSize', 'Dosyaların toplam boyutu 5 MB\'ı aşamaz.'))
        return prev
      }
      setFileError(null)
      return [...prev, ...incoming]
    })
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSending(true)
    setError(null)
    try {
      const pageContext = variant === 'createOnly' ? '/lumespec-support' : location.pathname
      const supportRequestId = await api.submitSupportRequest(trimmedSubject, trimmedMessage, pageContext)
      for (const file of pendingFiles) {
        await api.uploadSupportRequestAttachment(supportRequestId, file)
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportRequests.list() })
      const mine = await queryClient.fetchQuery({
        queryKey: queryKeys.supportRequests.mine(),
        queryFn: () => api.getMySupportRequests(),
      })
      const created = mine.find(item => item.supportRequestId === supportRequestId)
      setCentralSyncFailed(Boolean(created?.centralSyncError))
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportRequests.mine() })
      setSent(true)
      setSubject('')
      setMessage('')
      setPendingFiles([])
    } catch {
      setError(t('support.sendError', 'Talep gönderilemedi. Lütfen tekrar deneyin.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalBackdrop onEscapeClose={handleClose}>
      <div className="support-request-dialog relative flex max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-[34rem] flex-col rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('common.close', 'Kapat')}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <X className="size-4" />
        </button>

        <h3 className="mb-3 border-b border-slate-200 pb-2 pr-8 text-base font-semibold text-slate-900">
          {t('support.dialogTitle', 'Lumespec Destek')}
        </h3>

        <div className="min-h-0 overflow-y-auto pr-1">
          {sent ? (
            <div className="space-y-4">
              {centralSyncFailed ? (
                <p className="text-sm font-medium text-amber-800">
                  {t(
                    'support.sentLocalOnly',
                    'Talebiniz kaydedildi ancak merkezi Lumespec destek sistemine iletilemedi. Lütfen konuyu ve mesajı biraz daha ayrıntılı yazarak tekrar deneyin veya destek@lumespec.com adresine yazın.',
                  )}
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  {t('support.sentMessage', 'Talebiniz alındı. Lumespec ekibi en kısa sürede sizinle iletişime geçecek.')}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="button" variant="primary" onClick={handleClose}>
                  {t('common.close', 'Kapat')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t('support.subjectLabel', 'Konu')}
                </label>
                <input
                  type="text"
                  className="field-input support-request-dialog-field w-full"
                  placeholder={t('support.subjectPlaceholder', 'Konu başlığı')}
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  onBlur={() => setSubject(current => toSentenceCaseTr(current))}
                  maxLength={200}
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-500">
                  {t('support.subjectHint', 'Konu en az 4 karakter olmalıdır.')}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t('support.columns.message', 'Açıklama')}
                </label>
                <textarea
                  className="field-textarea support-request-dialog-field w-full"
                  rows={4}
                  placeholder={t('support.messagePlaceholder', 'Destek talebinizi kısaca açıklayınız...')}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onBlur={() => setMessage(current => toSentenceCaseTr(current))}
                  maxLength={4000}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {t('support.messageHint', 'Mesaj en az 10 karakter olmalıdır.')}
                </p>
              </div>

              {variant === 'createOnly' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {t('attachments.addFile', 'Dosya ekle')}
                  </label>
                  <div className="relative rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center">
                    <Paperclip className="mx-auto mb-1 size-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">
                      {t('attachments.uploadHint', 'JPG, PNG, PDF, Office — toplam max 5 MB')}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ATTACHMENT_FILE_ACCEPT}
                      multiple
                      className="absolute inset-0 z-10 cursor-pointer opacity-0"
                      disabled={sending}
                      onClick={event => {
                        if (supportsAttachmentFilePicker()) {
                          event.preventDefault()
                          void pickAttachmentFiles().then(addPickedFiles)
                        }
                      }}
                      onChange={event => {
                        addPickedFiles(Array.from(event.target.files ?? []))
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                    />
                  </div>
                  {pendingFiles.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {pendingFiles.map((file, idx) => (
                        <li key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate">{lowercaseFileExtension(file.name)}</span>
                          <button
                            type="button"
                            className="shrink-0 font-medium text-red-500"
                            onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                          >
                            {t('common.delete', 'Sil')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {fileError ? <p className="mt-1 text-xs font-semibold text-red-600">{fileError}</p> : null}
                </div>
              ) : null}

              {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={handleClose}>
                  {t('common.cancel', 'İptal')}
                </Button>
                <Button type="button" variant="primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
                  {sending ? t('common.sending', 'Gönderiliyor...') : t('support.send', 'Gönder')}
                </Button>
              </div>
            </div>
          )}

          {showHistory && !sent ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-900">
                {t('support.myRequestsTitle', 'Son destek taleplerim')}
              </h4>
              {myRequestsQuery.isLoading ? (
                <p className="mt-2 text-xs text-slate-500">{t('common.loading', 'Yükleniyor...')}</p>
              ) : (myRequestsQuery.data ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  {t('support.noRequests', 'Henüz destek talebiniz yok.')}
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {(myRequestsQuery.data ?? []).slice(0, 10).map(item => {
                    const centralStatusLabel = formatCentralSupportStatus(item.centralStatus, t)
                    return (
                      <div key={item.supportRequestId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.subject}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.centralTicketNo ?? t('support.localTicket', 'Yerel kayıt')}
                            </p>
                          </div>
                          {centralStatusLabel ? (
                            <span className="rounded-full bg-white px-2 py-1 text-[0.68rem] font-semibold text-slate-600 ring-1 ring-slate-200">
                              {centralStatusLabel}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-slate-600">{item.message}</p>
                        {item.messages.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {item.messages.map(messageItem => (
                              <div
                                key={`${item.supportRequestId}-${messageItem.createdAt}-${messageItem.direction}`}
                                className={messageItem.direction === 'support'
                                  ? 'rounded-lg bg-emerald-50 p-2 text-xs text-emerald-950'
                                  : 'rounded-lg bg-white p-2 text-xs text-slate-700'}
                              >
                                <div className="mb-1 flex items-center justify-between gap-2 font-semibold">
                                  <span>{messageItem.authorName ?? (messageItem.direction === 'support' ? 'Lumespec Destek' : 'Siz')}</span>
                                  <span className="font-normal text-slate-500">
                                    {new Date(messageItem.createdAt).toLocaleString('tr-TR')}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap">{messageItem.body}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {item.centralSyncError ? (
                          <p className="mt-2 text-xs font-semibold text-red-600">{item.centralSyncError}</p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </ModalBackdrop>
  )
}
