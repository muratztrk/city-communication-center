import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { Button } from '../ui/button'

interface ChangePasswordModalProps {
  onClose: () => void
}

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

function PasswordField({ id, label, value, onChange, autoFocus }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const { t } = useTranslation()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="field-input w-full pr-10"
          value={value}
          autoFocus={autoFocus}
          autoComplete={id === 'current-password' ? 'current-password' : 'new-password'}
          onChange={event => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={() => setVisible(prev => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
          aria-label={visible ? t('common.hide', 'Gizle') : t('common.show', 'Göster')}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    setError(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('changePassword.errors.allRequired', 'Lütfen tüm alanları doldurun.'))
      return
    }
    // En az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter (card 521).
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
      setError(t('changePassword.errors.policy', 'Parola minimum 8 karakter olmalı; büyük harf, küçük harf, rakam ve özel karakter içermelidir.'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('changePassword.errors.mismatch', 'Yeni parolalar eşleşmiyor.'))
      return
    }
    setSubmitting(true)
    try {
      await api.changeMyPassword({ currentPassword, newPassword, confirmPassword })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('changePassword.errors.failed', 'Parola değiştirilemedi.'))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-secondary,var(--color-primary))] px-6 py-4">
          <KeyRound className="size-5 shrink-0 text-white/80" />
          <h2 className="flex-1 text-base font-extrabold text-white">
            {t('changePassword.title', 'Parolamı Değiştir')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            aria-label={t('common.close', 'Kapat')}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        {success ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 className="size-12 text-[color:var(--color-success)]" />
            <p className="text-sm font-semibold text-slate-700">
              {t('changePassword.success', 'Parolanız başarıyla değiştirildi.')}
            </p>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4 px-6 py-5"
            onSubmit={event => { event.preventDefault(); void handleSubmit() }}
          >
            <PasswordField
              id="current-password"
              label={t('changePassword.currentPassword', 'Eski parola')}
              value={currentPassword}
              onChange={setCurrentPassword}
              autoFocus
            />
            <PasswordField
              id="new-password"
              label={t('changePassword.newPassword', 'Yeni Parola')}
              value={newPassword}
              onChange={setNewPassword}
            />
            <PasswordField
              id="confirm-password"
              label={t('changePassword.confirmPassword', 'Yeni Parola Tekrarı')}
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {/* Footer: green "Değiştir" button bottom-right */}
            <div className="mt-1 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                {t('common.cancel', 'Vazgeç')}
              </Button>
              <Button type="submit" variant="success" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {t('changePassword.submit', 'Değiştir')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
