import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button } from '../ui/button'
import { ModalBackdrop } from '../ui/modal-backdrop'
import { api } from '../../api/client'
import { queryKeys } from '../../api/queryKeys'

interface SupportRequestDialogProps {
  open: boolean
  onClose: () => void
}

export function SupportRequestDialog({ open, onClose }: SupportRequestDialogProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (!open) return null

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0 && !sending

  const handleClose = () => {
    setSubject('')
    setMessage('')
    setError(null)
    setSent(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSending(true)
    setError(null)
    try {
      await api.submitSupportRequest(subject.trim(), message.trim(), location.pathname)
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportRequests.list() })
      setSent(true)
      setSubject('')
      setMessage('')
    } catch {
      setError(t('support.sendError', 'Talep gönderilemedi. Lütfen tekrar deneyin.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalBackdrop onEscapeClose={handleClose}>
      <div className="support-request-dialog relative w-full max-w-[26rem] rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl">
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

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t('support.sentMessage', 'Talebiniz alındı. Lumespec ekibi en kısa sürede sizinle iletişime geçecek.')}
            </p>
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
                maxLength={200}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t('support.messageLabel', 'Mesaj')}
              </label>
              <textarea
                className="field-textarea support-request-dialog-field w-full"
                rows={4}
                placeholder={t('support.messagePlaceholder', 'Sorununuzu kısaca açıklayın.')}
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={4000}
              />
            </div>
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
      </div>
    </ModalBackdrop>
  )
}
